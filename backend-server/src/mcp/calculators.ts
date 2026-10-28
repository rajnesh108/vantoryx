import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod-v4";
import { bodyMassIndex, convertGlucose, convertTemperature, type CalcResult } from "../services/mcp/calculate";

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

function createCalculatorServer(): McpServer {
  const server = new McpServer({ name: "vantoryx-calculators", version: "1.0.0" });

  server.registerTool(
    "convert-glucose",
    {
      title: "Convert glucose units",
      description:
        "Convert one blood glucose number between mmol/L and mg/dL. Use only when the question asks for that conversion and includes the number. This does not interpret the result.",
      inputSchema: z.object({
        value: z.number().describe("Glucose number to convert"),
        from: z.enum(["mmol/L", "mg/dL"]).describe("Unit of the input value"),
        to: z.enum(["mmol/L", "mg/dL"]).describe("Unit to convert into"),
      }),
      annotations: readOnly,
    },
    async ({ value, from, to }) => textResult(convertGlucose(value, from, to))
  );

  server.registerTool(
    "convert-temperature",
    {
      title: "Convert temperature",
      description:
        "Convert one temperature between Celsius (C) and Fahrenheit (F). Use only when the question asks for that conversion and includes the number.",
      inputSchema: z.object({
        value: z.number().describe("Temperature number to convert"),
        from: z.enum(["C", "F"]).describe("Unit of the input value"),
        to: z.enum(["C", "F"]).describe("Unit to convert into"),
      }),
      annotations: readOnly,
    },
    async ({ value, from, to }) => textResult(convertTemperature(value, from, to))
  );

  server.registerTool(
    "body-mass-index",
    {
      title: "Body mass index",
      description:
        "Compute body mass index from weight in kilograms and height in centimeters. Use only when both numbers are in the question. Returns the number only, not a diagnosis.",
      inputSchema: z.object({
        weightKg: z.number().describe("Body weight in kilograms"),
        heightCm: z.number().describe("Height in centimeters"),
      }),
      annotations: readOnly,
    },
    async ({ weightKg, heightCm }) => textResult(bodyMassIndex(weightKg, heightCm))
  );

  return server;
}

function textResult(result: CalcResult): { content: [{ type: "text"; text: string }]; isError?: boolean } {
  if (!result.ok) return { content: [{ type: "text", text: result.error }], isError: true };
  return { content: [{ type: "text", text: result.text }] };
}

function isCalculatorProcess(): boolean {
  return process.argv.some((arg) => arg.replace(/\\/g, "/").endsWith("/mcp/calculators.ts"));
}

// stdout is the MCP stream. Keep logs on stderr.
if (isCalculatorProcess()) {
  serveStdio(() => createCalculatorServer());
  console.error("vantoryx calculators MCP server running on stdio");
}
