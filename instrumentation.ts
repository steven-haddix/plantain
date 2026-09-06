import { registerOTel } from "@vercel/otel";
import { LangfuseExporter } from "langfuse-vercel";

export function register() {
  const hasLangfuseCredentials = Boolean(
    process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
  );

  registerOTel({
    serviceName: "plantain",
    ...(hasLangfuseCredentials
      ? { traceExporter: new LangfuseExporter() }
      : {}),
  });
}
