/**
 * MCP server entry point.
 *
 * Exposes the three SmartKart endpoints as MCP tools so AI agents (Cursor,
 * Claude Desktop, Codex, etc.) can call them conversationally.
 *
 * Usage in an MCP host config:
 *
 * ```jsonc
 * {
 *   "mcpServers": {
 *     "smartkart": {
 *       "command": "npx",
 *       "args": ["-y", "@stronger-ecommerce/smartkart-api", "smartkart-mcp"],
 *       "env": {
 *         "SMARTKART_API_TOKEN": "...",
 *         "SMARTKART_STORE_ID": "42"
 *       }
 *     }
 *   }
 * }
 * ```
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isSmartKartApiError, SmartKartClient } from "../index.js";

const PACKAGE_NAME = "@stronger-ecommerce/smartkart-api";
const PACKAGE_VERSION = "0.1.3";

function getEnv(name: string, required = false): string | undefined {
  const value = process.env[name];
  if (required && (!value || value.length === 0)) {
    process.stderr.write(`smartkart-mcp: required env var ${name} is not set.\n`);
    process.exit(1);
  }
  return value;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function main(): Promise<void> {
  const token = getEnv("SMARTKART_API_TOKEN", true)!;
  const storeIdRaw = getEnv("SMARTKART_STORE_ID");
  const baseUrl = getEnv("SMARTKART_BASE_URL");

  const client = new SmartKartClient({
    token,
    defaultStoreId: storeIdRaw ? Number(storeIdRaw) : undefined,
    baseUrl,
    logger: {
      debug: (msg, meta) =>
        process.stderr.write(`[smartkart-mcp] ${msg} ${meta ? JSON.stringify(meta) : ""}\n`),
      warn: (msg, meta) =>
        process.stderr.write(`[smartkart-mcp] WARN ${msg} ${meta ? JSON.stringify(meta) : ""}\n`),
    },
  });

  const server = new McpServer({
    name: "smartkart",
    version: PACKAGE_VERSION,
  });

  server.registerTool(
    "smartkart_get_items",
    {
      title: "Get items",
      description:
        "Fetch a paginated list of items from SmartKart. Use itemStatus to filter, and lastDateModified to fetch only recent changes.",
      inputSchema: {
        pageSize: z.number().int().positive().default(50),
        pageNumber: z.number().int().positive().default(1),
        storeID: z
          .number()
          .int()
          .optional()
          .describe("Override the default store ID"),
        itemStatus: z
          .enum(["Active", "Inactive"])
          .nullish()
          .describe("Filter by status. Omit/null returns all."),
        upc: z.string().optional(),
        name: z.string().optional(),
        modelNumber: z.string().optional(),
        lastDateModified: z
          .string()
          .optional()
          .describe('ISO-8601 timestamp, e.g. "2026-01-01T00:00:00"'),
      },
    },
    async (input) => {
      try {
        const page = await client.getItems({
          pageSize: input.pageSize,
          pageNumber: input.pageNumber,
          itemsFilter: {
            storeID: input.storeID,
            itemStatus: input.itemStatus,
            upc: input.upc,
            name: input.name,
            modelNumber: input.modelNumber,
            lastDateModified: input.lastDateModified,
          },
        });
        return {
          content: [
            {
              type: "text",
              text: safeStringify({
                totalRecords: page.totalRecords,
                currentPage: page.currentPage,
                pageSize: page.pageSize,
                returned: page.records.length,
                records: page.records,
              }),
            },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.registerTool(
    "smartkart_get_customers",
    {
      title: "Get customers",
      description: "Fetch a paginated list of SmartKart customers with optional filters.",
      inputSchema: {
        pageSize: z.number().int().positive().default(50),
        pageNumber: z.number().int().positive().default(1),
        customerNo: z
          .string()
          .optional()
          .describe('Customer number, usually formatted "(000)000-0000".'),
        lastName: z.string().optional(),
        firstName: z.string().optional(),
        email: z.string().optional(),
        phoneNumber1: z.string().optional(),
        phoneNumber2: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const page = await client.getCustomers({
          pageSize: input.pageSize,
          pageNumber: input.pageNumber,
          customerFilter: {
            customerNo: input.customerNo,
            lastName: input.lastName,
            firstName: input.firstName,
            email: input.email,
            phoneNumber1: input.phoneNumber1,
            phoneNumber2: input.phoneNumber2,
          },
        });
        return {
          content: [
            {
              type: "text",
              text: safeStringify({
                totalRecords: page.totalRecords,
                currentPage: page.currentPage,
                pageSize: page.pageSize,
                returned: page.records.length,
                records: page.records,
              }),
            },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.registerTool(
    "smartkart_create_phone_order",
    {
      title: "Create phone order",
      description:
        "Create a phone order in SmartKart. The shipping address (CustomerShippingAddress) uses PascalCase keys; the main address uses camelCase. Returns the new phoneOrderNo.",
      inputSchema: {
        customerNo: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        phone1: z.string().optional(),
        address1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        shippingAddress1: z
          .string()
          .optional()
          .describe("Shipping address line 1 (separate from billing)."),
        shippingCity: z.string().optional(),
        shippingState: z.string().optional(),
        shippingZipCode: z.string().optional(),
        phoneOrderType: z
          .string()
          .describe("Your registered app name from the SmartKart office."),
        tenderName: z.string().optional(),
        TakenBy: z.string().optional(),
        Shift: z.string().optional(),
        deliveryDate: z.string().optional(),
        orderDetails: z
          .array(
            z.object({
              barCode: z.string(),
              qty: z.number(),
              uomType: z.union([z.literal(0), z.literal(2)]).default(0),
              note: z.string().optional(),
              sortOrder: z.number().int().positive(),
            }),
          )
          .min(1),
      },
    },
    async (input) => {
      try {
        const shipping =
          input.shippingAddress1 || input.shippingCity || input.shippingState || input.shippingZipCode
            ? [
                {
                  Address1: input.shippingAddress1,
                  City: input.shippingCity,
                  State: input.shippingState,
                  ZipCode: input.shippingZipCode,
                },
              ]
            : undefined;

        const result = await client.createPhoneOrder({
          customerNo: input.customerNo,
          firstName: input.firstName,
          lastName: input.lastName,
          address: {
            address1: input.address1,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            phone1: input.phone1,
          },
          CustomerShippingAddress: shipping,
          phoneOrderType: input.phoneOrderType,
          tenderName: input.tenderName,
          TakenBy: input.TakenBy,
          Shift: input.Shift,
          deliveryDate: input.deliveryDate,
          orderDetails: input.orderDetails,
        });
        return {
          content: [
            { type: "text", text: `Created phone order ${result.phoneOrderNo}` },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[smartkart-mcp] ${PACKAGE_NAME} v${PACKAGE_VERSION} ready (3 tools registered)\n`,
  );
}

function formatError(err: unknown): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  let text: string;
  if (isSmartKartApiError(err)) {
    text = `SmartKart API error from ${err.endpoint} (status ${err.status}): ${err.apiDescription ?? err.message}\n${safeStringify({ apiErrors: err.apiErrors })}`;
  } else if (err instanceof Error) {
    text = `${err.name}: ${err.message}`;
  } else {
    text = `Unknown error: ${safeStringify(err)}`;
  }
  return { content: [{ type: "text", text }], isError: true };
}

main().catch((err) => {
  process.stderr.write(`[smartkart-mcp] fatal: ${(err as Error)?.stack ?? err}\n`);
  process.exit(1);
});
