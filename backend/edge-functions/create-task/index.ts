// LearnLynk Tech Test - Task 3: Edge Function create-task

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type CreateTaskPayload = {
  application_id: string;
  task_type: string;
  due_at: string;
};

const VALID_TYPES = ["call", "email", "review"];

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Partial<CreateTaskPayload>;
    const { application_id, task_type, due_at } = body;

    // 1. Validation
    if (!application_id || !task_type || !due_at) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!VALID_TYPES.includes(task_type)) {
      return new Response(JSON.stringify({ error: `Invalid task_type. Must be one of: ${VALID_TYPES.join(", ")}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const dueDate = new Date(due_at);
    const now = new Date();
    if (isNaN(dueDate.getTime()) || dueDate <= now) {
      return new Response(JSON.stringify({ error: "due_at must be a valid date in the future" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Insert into tasks table
    // We need a tenant_id. In a real app, this might come from looking up the application 
    // or passed in headers. For this test, we'll fetch it from the application to be safe.
    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select('tenant_id')
      .eq('id', application_id)
      .single();

    if (appError || !appData) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        tenant_id: appData.tenant_id,
        application_id,
        type: task_type,
        due_at,
        status: 'open'
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to create task" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Return success
    return new Response(JSON.stringify({ success: true, task_id: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});