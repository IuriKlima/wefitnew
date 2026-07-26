"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { StudentDetailsPayload, StudentStatus } from "@gym-platform/contracts";

import {
  createStudent,
  inactivateStudent,
  reactivateStudent,
  replaceStudentUnits,
  updateStudent
} from "../lib/admin-api";

export async function createStudentAction(formData: FormData): Promise<void> {
  const student = await createStudent({
    ...readStudentDetails(formData),
    status: readStatus(formData),
    unitIds: readUnitIds(formData)
  });

  revalidatePath("/students");
  redirect(`/students/${student.id}`);
}

export async function updateStudentAction(studentId: string, formData: FormData): Promise<void> {
  await updateStudent(studentId, readStudentDetails(formData));

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}`);
}

export async function inactivateStudentAction(studentId: string): Promise<void> {
  await inactivateStudent(studentId);

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
}

export async function reactivateStudentAction(studentId: string): Promise<void> {
  await reactivateStudent(studentId);

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
}

export async function replaceStudentUnitsAction(
  studentId: string,
  formData: FormData
): Promise<void> {
  await replaceStudentUnits(studentId, readUnitIds(formData));

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}?tab=units`);
}

function readStudentDetails(formData: FormData): StudentDetailsPayload {
  return {
    name: requiredString(formData, "name"),
    socialName: nullableString(formData, "socialName"),
    email: nullableString(formData, "email"),
    phone: nullableString(formData, "phone"),
    birthDate: nullableString(formData, "birthDate"),
    operationalNote: nullableString(formData, "operationalNote")
  };
}

function readUnitIds(formData: FormData): string[] {
  return formData.getAll("unitIds").filter((value): value is string => typeof value === "string");
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Campo obrigatorio ausente: ${key}.`);
  }

  return value.trim();
}

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function readStatus(formData: FormData): StudentStatus {
  return formData.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}
