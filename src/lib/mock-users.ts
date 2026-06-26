// Offline mock users — used when there's no live database connection.
// These mirror prisma/seed.ts exactly, so behavior is identical once
// the real Postgres connection is wired up and this fallback stops firing.

export interface MockUser {
  id: string;
  storeId: string;
  storeName: string;
  email: string;
  password: string; // plaintext, dev-only — never do this with a real DB
  name: string;
  role: "MANAGER" | "CLERK" | "VIEWER";
  active: boolean;
}

export const mockUsers: MockUser[] = [
  {
    id: "mock-user-manager",
    storeId: "mock-store-1",
    storeName: "Sunrise Mart #4",
    email: "manager@lottoops.test",
    password: "password123",
    name: "Walter Opiyo",
    role: "MANAGER",
    active: true,
  },
  {
    id: "mock-user-clerk",
    storeId: "mock-store-1",
    storeName: "Sunrise Mart #4",
    email: "clerk@lottoops.test",
    password: "password123",
    name: "WalterO",
    role: "CLERK",
    active: true,
  },
  {
    id: "mock-user-viewer",
    storeId: "mock-store-1",
    storeName: "Sunrise Mart #4",
    email: "viewer@lottoops.test",
    password: "password123",
    name: "Walter",
    role: "VIEWER",
    active: true,
  },
];

export function findMockUser(email: string): MockUser | undefined {
  return mockUsers.find((u) => u.email === email.toLowerCase().trim());
}
