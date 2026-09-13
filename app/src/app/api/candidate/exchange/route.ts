import { exchangeInvitationSecret } from "@/lib/hiring/invitations";
import { hiringEnabled } from "@/lib/hiring/config";

export async function POST(request: Request) {
  if (!hiringEnabled()) {
    return Response.json({ error: "Hiring flow disabled" }, { status: 503 });
  }
  const body = await request.json() as { secret?: string };
  if (!body.secret) return Response.json({ error: "secret required" }, { status: 400 });
  const invite = await exchangeInvitationSecret(body.secret);
  if (!invite) return Response.json({ error: "Invalid or expired invitation" }, { status: 404 });
  return Response.json({
    invitationId: invite.id,
    candidacyId: invite.candidacy_id,
    jobTitle: invite.job_title,
    orgName: invite.org_name,
  });
}
