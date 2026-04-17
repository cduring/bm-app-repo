import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });

  const body = await req.json();
  const { type, fromUser, payload } = body;

  let subject: string, html: string;

  if (type === "contact_support") {
    subject = `[Support] ${payload.subject}`;
    html = `<h2>Contact Support</h2>
<p><strong>From:</strong> ${fromUser.displayName} (${fromUser.email})</p>
<p><strong>Subject:</strong> ${payload.subject}</p>
<hr/>
<p><strong>Message:</strong></p>
<p>${payload.message.replace(/\n/g, "<br>")}</p>`;
  } else if (type === "report_user") {
    subject = `[Report] ${fromUser.displayName} reported ${payload.reportedDisplayName}`;
    html = `<h2>User Report</h2>
<p><strong>Reported by:</strong> ${fromUser.displayName} (${fromUser.email})</p>
<p><strong>Reported user:</strong> ${payload.reportedDisplayName}</p>
<p><strong>Reported user ID:</strong> ${payload.reportedUserId}</p>
<hr/>
<p><strong>Reason:</strong></p>
<p>${payload.reason.replace(/\n/g, "<br>")}</p>`;
  } else {
    return new Response(JSON.stringify({ error: "Unknown type" }), {
      status: 400,
    });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Loam App <noreply@loamapp.xyz>", // swap for verified domain in prod
      to: ["loamtoapp@gmail.com"],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    console.error("[send-email] Resend error:", await res.text());
    return new Response(JSON.stringify({ error: "Delivery failed" }), {
      status: 502,
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
