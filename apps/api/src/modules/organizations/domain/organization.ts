export type OrganizationType = "PERSONAL" | "GYM" | "NETWORK";

export type OrganizationSnapshot = {
  id: string;
  type: OrganizationType;
  legalName: string;
  tradeName: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatedOrganizationResult = {
  organization: OrganizationSnapshot;
  defaultUnit: {
    id: string;
    organizationId: string;
    name: string;
    code: string | null;
  };
};
