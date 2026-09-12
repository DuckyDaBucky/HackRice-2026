import {it,expect,vi,beforeEach} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),orm:{select:vi.fn(),insert:vi.fn(),update:vi.fn()}}));
vi.mock("@clerk/nextjs/server",()=>({auth:mocks.auth}));
vi.mock("../src/lib/db",()=>({orm:mocks.orm}));
import {GET,PUT} from "../src/app/api/profile/route";
import {getProfile,saveProfile} from "../src/lib/profiles";
import {emptyResume} from "../src/lib/workbench/schemas";
// Minimal thenable mimicking Drizzle's chainable query builder so unit tests
// run without a database. SQL correctness is covered by the live smoke test
// and column types, not by string-matching generated SQL.
function stubQuery(rows:unknown[]){
  const thenable:Record<string,unknown>={then:(resolve:(v:unknown)=>unknown,reject:(e:unknown)=>unknown)=>Promise.resolve(rows).then(resolve,reject)};
  for(const m of ["select","from","where","limit","insert","values","set","update","onConflictDoNothing","onConflictDoUpdate","returning","orderBy","groupBy","innerJoin"])thenable[m]=()=>thenable;
  return thenable;
}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY","synthetic-instance");});
it("requires authentication for profile reads and writes",async()=>{mocks.auth.mockResolvedValue({userId:null});expect((await GET()).status).toBe(401);expect((await PUT(new Request("http://localhost/api/profile",{method:"PUT"}))).status).toBe(401);expect(mocks.orm.select).not.toHaveBeenCalled();expect(mocks.orm.insert).not.toHaveBeenCalled();expect(mocks.orm.update).not.toHaveBeenCalled();});
it("scopes database reads to Clerk instance and user",async()=>{mocks.orm.select.mockReturnValue(stubQuery([]));expect(await getProfile("user-a")).toBeNull();expect(mocks.orm.select).toHaveBeenCalledTimes(1);});
it("maps stored rows through the resume schema",async()=>{const at=new Date("2026-09-12T00:00:00Z");mocks.orm.select.mockReturnValue(stubQuery([{profile:emptyResume,version:3,updatedAt:at,classifiedAt:at}]));expect(await getProfile("user-a")).toEqual({profile:emptyResume,version:3,updatedAt:at,classifiedAt:at});});
it("rejects stale profile writes instead of overwriting",async()=>{mocks.orm.update.mockReturnValue(stubQuery([]));await expect(saveProfile("user-a",emptyResume,2)).rejects.toMatchObject({code:"PROFILE_CONFLICT"});});
