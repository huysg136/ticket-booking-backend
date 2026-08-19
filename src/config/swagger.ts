import swaggerJsdoc from "swagger-jsdoc";

const rateLimitHeaders = {
  "X-RateLimit-Limit": {
    description: "Maximum requests allowed in the current window",
    schema: { type: "integer", example: 10 },
  },
  "X-RateLimit-Remaining": {
    description: "Requests remaining in the current window",
    schema: { type: "integer", example: 9 },
  },
  "X-RateLimit-Reset": {
    description: "Unix timestamp in milliseconds when the quota resets",
    schema: { type: "integer", format: "int64" },
  },
};

const rateLimitExceeded = {
  description: "Rate limit exceeded",
  headers: {
    ...rateLimitHeaders,
    "Retry-After": {
      description: "Seconds until the client should retry",
      schema: { type: "integer", minimum: 1 },
    },
  },
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
      example: {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
        },
      },
    },
  },
};

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Concert Ticket Booking API",
      version: "1.0.0",
      description: "Backend API for Concert Ticket Booking Platform",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local server",
      },
    ],
    tags: [{ name: "Auth" }, { name: "Concerts" }, { name: "Bookings" }, { name: "Operations" }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: { code: { type: "string" }, message: { type: "string" } },
            },
          },
        },
        Credentials: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "customer@example.com" },
            password: { type: "string", example: "Customer123!" },
          },
        },
        BookingInput: {
          type: "object",
          required: ["items"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["ticketCategoryId", "quantity"],
                properties: {
                  ticketCategoryId: { type: "string", format: "uuid" },
                  quantity: { type: "integer", minimum: 1, example: 2 },
                },
              },
            },
            voucherCode: { type: "string", example: "FLASH20" },
          },
        },
        ConcertInput: {
          type: "object",
          required: ["name", "venue", "startAt"],
          properties: {
            name: { type: "string", example: "GEEK Up Winter Concert" },
            description: { type: "string", example: "New concert campaign" },
            venue: { type: "string", example: "Ho Chi Minh City" },
            startAt: { type: "string", format: "date-time", example: "2031-01-01T12:00:00Z" },
            ticketCategories: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "price", "totalQuantity"],
                properties: {
                  name: { type: "string", example: "STANDARD" },
                  price: { type: "integer", example: 500000 },
                  totalQuantity: { type: "integer", example: 100 },
                },
              },
            },
          },
        },
        VoucherInput: {
          type: "object",
          required: ["code", "type", "value", "usageLimit", "startsAt", "expiresAt"],
          properties: {
            code: { type: "string", example: "FLASH10" },
            type: { type: "string", enum: ["PERCENTAGE", "FIXED_AMOUNT"] },
            value: { type: "number", example: 10 },
            usageLimit: { type: "integer", example: 100 },
            startsAt: { type: "string", format: "date-time" },
            expiresAt: { type: "string", format: "date-time" },
            active: { type: "boolean", default: true },
            minOrderAmount: { type: "number", example: 500000 },
            maxDiscountAmount: { type: "number", example: 200000 },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: { summary: "Health check", responses: { "200": { description: "Healthy" } } },
      },
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register customer",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Credentials" } },
            },
          },
          responses: {
            "201": { description: "Registered", headers: rateLimitHeaders },
            "409": { description: "Email exists" },
            "429": rateLimitExceeded,
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Credentials" } },
            },
          },
          responses: {
            "200": { description: "JWT issued", headers: rateLimitHeaders },
            "401": { description: "Invalid credentials" },
            "429": rateLimitExceeded,
          },
        },
      },
      "/api/concerts": {
        get: {
          tags: ["Concerts"],
          summary: "List published concerts",
          responses: { "200": { description: "Concert list" } },
        },
      },
      "/api/concerts/{id}": {
        get: {
          tags: ["Concerts"],
          summary: "Published concert detail",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: { "200": { description: "Concert" }, "404": { description: "Not found" } },
        },
      },
      "/api/bookings": {
        post: {
          tags: ["Bookings"],
          security: [{ bearerAuth: [] }],
          summary: "Atomically reserve tickets",
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: true,
              schema: { type: "string", example: "checkout-2026-0001" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/BookingInput" } },
            },
          },
          responses: {
            "201": { description: "Created", headers: rateLimitHeaders },
            "200": { description: "Idempotent replay", headers: rateLimitHeaders },
            "409": { description: "Inventory or voucher conflict" },
            "429": rateLimitExceeded,
          },
        },
      },
      "/api/bookings/me": {
        get: {
          tags: ["Bookings"],
          security: [{ bearerAuth: [] }],
          summary: "My bookings",
          responses: { "200": { description: "Bookings" } },
        },
      },
      "/api/bookings/{id}": {
        get: {
          tags: ["Bookings"],
          security: [{ bearerAuth: [] }],
          summary: "My booking detail",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: { "200": { description: "Booking" }, "404": { description: "Not found" } },
        },
      },
      "/api/operations/bookings": {
        get: {
          tags: ["Operations"],
          security: [{ bearerAuth: [] }],
          summary: "List bookings",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "suspicious", in: "query", schema: { type: "boolean" } },
          ],
          responses: { "200": { description: "Paginated bookings" } },
        },
      },
      "/api/operations/bookings/{id}": {
        get: {
          tags: ["Operations"],
          security: [{ bearerAuth: [] }],
          summary: "Inspect booking detail",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            "200": { description: "Booking detail" },
            "404": { description: "Booking not found" },
          },
        },
      },
      "/api/operations/bookings/{id}/status": {
        patch: {
          tags: ["Operations"],
          security: [{ bearerAuth: [] }],
          summary: "Apply valid booking status transition",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "WAITING_FOR_PAYMENT" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated" },
            "409": { description: "Invalid transition" },
          },
        },
      },
      "/api/operations/concerts": {
        post: {
          tags: ["Operations"],
          security: [{ bearerAuth: [] }],
          summary: "Create draft concert",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ConcertInput" } },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/operations/concerts/{id}/publish": {
        patch: {
          tags: ["Operations"],
          security: [{ bearerAuth: [] }],
          summary: "Publish concert",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: { "200": { description: "Published" } },
        },
      },
      "/api/operations/ticket-categories/{id}/availability": {
        get: {
          tags: ["Operations"],
          security: [{ bearerAuth: [] }],
          summary: "Inspect availability",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: { "200": { description: "Availability" } },
        },
      },
      "/api/operations/vouchers": {
        get: {
          tags: ["Operations"],
          security: [{ bearerAuth: [] }],
          summary: "List vouchers",
          responses: { "200": { description: "Vouchers" } },
        },
        post: {
          tags: ["Operations"],
          security: [{ bearerAuth: [] }],
          summary: "Create voucher",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/VoucherInput" } },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
    },
  },

  apis: ["./src/modules/**/*.routes.ts", "./src/modules/**/*.route.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
