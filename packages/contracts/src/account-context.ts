export type AccountOrganizationType = "PERSONAL" | "GYM" | "NETWORK";

export type AccountContextRole = {
  key: string;
  name: string;
  scope: "ORGANIZATION" | "UNIT";
  unitId?: string;
};

export type AccountContextUnit = {
  id: string;
  name: string;
  code: string | null;
  isAllowed: true;
};

export type AccountContextOrganization = {
  id: string;
  name: string;
  type: AccountOrganizationType;
  isGlobalMember: boolean;
  roles: AccountContextRole[];
  units: AccountContextUnit[];
};

export type CurrentAccountContext = {
  user: {
    id: string;
    name: string | null;
  };
  organizations: AccountContextOrganization[];
};

export type ActiveAccountContext = {
  organization: AccountContextOrganization;
  unit?: AccountContextUnit;
};
