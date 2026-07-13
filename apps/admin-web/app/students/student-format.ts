import type { Student } from "@gym-platform/contracts";

export function displayStudentName(student: Student): string {
  return student.socialName || student.name;
}
