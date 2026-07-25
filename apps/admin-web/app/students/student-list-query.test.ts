import { describe, expect, it } from "vitest";

import { buildStudentsHref, parseStudentListQuery } from "./student-list-query";

describe("student list query", () => {
  it("normalizes supported filters, pagination and sorting", () => {
    expect(
      parseStudentListQuery({
        page: "2",
        pageSize: "50",
        search: "  ana  ",
        status: "INACTIVE",
        unitId: "11111111-1111-4111-8111-111111111111",
        sortBy: "updatedAt",
        sortDirection: "desc"
      })
    ).toEqual({
      page: "2",
      pageSize: "50",
      search: "ana",
      status: "INACTIVE",
      unitId: "11111111-1111-4111-8111-111111111111",
      sortBy: "updatedAt",
      sortDirection: "desc"
    });
  });

  it("uses safe defaults for unsupported values", () => {
    expect(
      parseStudentListQuery({
        page: "-1",
        pageSize: "1000",
        status: "ARCHIVED",
        sortBy: "email",
        sortDirection: "sideways"
      })
    ).toEqual({
      page: "1",
      pageSize: "20",
      search: undefined,
      status: undefined,
      unitId: undefined,
      sortBy: "name",
      sortDirection: "asc"
    });
  });

  it("preserves filters while changing pages", () => {
    expect(
      buildStudentsHref(
        {
          page: "1",
          pageSize: "20",
          search: "Ana Lima",
          status: "ACTIVE",
          sortBy: "name",
          sortDirection: "asc"
        },
        3
      )
    ).toBe(
      "/students?page=3&pageSize=20&search=Ana+Lima&status=ACTIVE&sortBy=name&sortDirection=asc"
    );
  });
});
