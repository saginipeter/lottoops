// Offline mock users — used when there's no live database connection.
// These mirror prisma/seed.ts exactly, so behavior is identical once
// the real Postgres connection is wired up and this fallback stops firing.

export interface MockUser {
  id: string;
  storeId: string;
  storeName: string;
  email: string;
  password: string;
  name: string;
  role: "OWNER" | "MANAGER" | "SHIFT_LEAD" | "EMPLOYEE";
  grantedPermissions: string[];
  active: boolean;
}

export const mockUsers: MockUser[] = [
  {
    id: "mock-user-owner",
    storeId: "mock-store-1",
    storeName: "Sunrise Mart #4",
    email: "owner@lottoops.test",
    password: "password123",
    name: "Store Owner",
    role: "OWNER",
    grantedPermissions: [],
    active: true,
  },
  {
    id: "mock-user-manager",
    storeId: "mock-store-1",
    storeName: "Sunrise Mart #4",
    email: "manager@lottoops.test",
    password: "password123",
    name: "Walter Opiyo",
    role: "MANAGER",
    grantedPermissions: [],
    active: true,
  },
  {
    id: "mock-user-shiftlead",
    storeId: "mock-store-1",
    storeName: "Sunrise Mart #4",
    email: "shiftlead@lottoops.test",
    password: "password123",
    name: "Alex Rivera",
    role: "SHIFT_LEAD",
    grantedPermissions: ["REPORTS", "RECEIVE_SHIPMENTS"],
    active: true,
  },
  {
    id: "mock-user-employee",
    storeId: "mock-store-1",
    storeName: "Sunrise Mart #4",
    email: "employee@lottoops.test",
    password: "password123",
    name: "Sam Lee",
    role: "EMPLOYEE",
    grantedPermissions: [],
    active: true,
  },
];

export function findMockUser(email: string): MockUser | undefined {
  return mockUsers.find((u) => u.email === email.toLowerCase().trim());
}
