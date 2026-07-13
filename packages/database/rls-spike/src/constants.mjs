export const SCHEMA_NAME = "rls_spike";

export const roles = Object.freeze({
  migrator: "wefit_migrator_spike_test",
  api: "wefit_api_spike_test",
  worker: "wefit_worker_spike_test",
  opsRead: "wefit_ops_read_spike_test",
  opsWrite: "wefit_ops_write_spike_test",
  owner: "wefit_rls_owner_spike_test"
});

export const ids = Object.freeze({
  organizationA: "10000000-0000-4000-8000-000000000001",
  organizationB: "20000000-0000-4000-8000-000000000001",
  unitA1: "11000000-0000-4000-8000-000000000001",
  unitA2: "12000000-0000-4000-8000-000000000001",
  unitB1: "21000000-0000-4000-8000-000000000001",
  userGlobalA: "aaaaaaaa-0000-4000-8000-000000000001",
  userScopedA1: "aaaaaaaa-0000-4000-8000-000000000002",
  userSuspendedA: "aaaaaaaa-0000-4000-8000-000000000003",
  userGlobalB: "bbbbbbbb-0000-4000-8000-000000000001",
  membershipGlobalA: "30000000-0000-4000-8000-000000000001",
  membershipScopedA1: "30000000-0000-4000-8000-000000000002",
  membershipSuspendedA: "30000000-0000-4000-8000-000000000003",
  membershipGlobalB: "30000000-0000-4000-8000-000000000004",
  roleGlobalA: "40000000-0000-4000-8000-000000000001",
  roleScopedA1: "40000000-0000-4000-8000-000000000002",
  roleSuspendedA: "40000000-0000-4000-8000-000000000003",
  roleGlobalB: "40000000-0000-4000-8000-000000000004",
  permissionStudentRead: "50000000-0000-4000-8000-000000000001",
  studentA1: "61000000-0000-4000-8000-000000000001",
  studentA2: "62000000-0000-4000-8000-000000000001",
  studentSharedA: "63000000-0000-4000-8000-000000000001",
  studentInvariantA1: "64000000-0000-4000-8000-000000000001",
  studentInvariantA2: "65000000-0000-4000-8000-000000000001",
  studentB1: "71000000-0000-4000-8000-000000000001",
  constraintProbeB: "72000000-0000-4000-8000-000000000001"
});
