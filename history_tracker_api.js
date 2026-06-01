/*
History and Event Log Tracker API server in JavaScript.

Run:
  node history_tracker_api.js

Then test in another terminal:
  node history_tracker_api_demo.js

Endpoints:
  GET  /api/v1/health
  POST /api/v1/events
  GET  /api/v1/events
  GET  /api/v1/events/search
  GET  /api/v1/events/:eventId
  PUT  /api/v1/events/:eventId

Authentication:
  Authorization: Bearer demo-token
*/

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const AUTH_TOKEN = "demo-token";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const DATA_FILE = path.join(__dirname, "history_tracker_events_js.json");

const ALLOWED_EVENT_TYPES = new Set([
  "SAVE",
  "LOAD",
  "VALIDATION_ATTEMPT",
  "VALIDATION_SUCCESS",
  "VALIDATION_FAILURE",
  "ERROR",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
]);

class Event {
  constructor({ eventType, source, description, userId = null, metadata = {}, id = null, timestamp = null }) {
    this._id = id || `evt_${crypto.randomBytes(5).toString("hex")}`;
    this._eventType = "";
    this._source = "";
    this._userId = userId;
    this._description = "";
    this._timestamp = timestamp || Event.currentTimestamp();
    this._metadata = metadata || {};

    this.setEventType(eventType);
    this.setSource(source);
    this.setDescription(description);
  }

  getId() {
    return this._id;
  }

  setId(id) {
    if (!id) {
      throw new Error("Event ID cannot be empty.");
    }
    this._id = id;
  }

  getEventType() {
    return this._eventType;
  }

  setEventType(eventType) {
    if (!eventType) {
      throw new Error("eventType is required.");
    }
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      throw new Error(`eventType must be one of: ${Array.from(ALLOWED_EVENT_TYPES).sort().join(", ")}.`);
    }
    this._eventType = eventType;
  }

  getSource() {
    return this._source;
  }

  setSource(source) {
    if (!source) {
      throw new Error("source is required.");
    }
    this._source = source;
  }

  getUserId() {
    return this._userId;
  }

  setUserId(userId) {
    this._userId = userId || null;
  }

  getDescription() {
    return this._description;
  }

  setDescription(description) {
    if (!description) {
      throw new Error("description is required.");
    }
    this._description = description;
  }

  getTimestamp() {
    return this._timestamp;
  }

  setTimestamp(timestamp) {
    if (!timestamp) {
      throw new Error("timestamp cannot be empty.");
    }
    this._timestamp = timestamp;
  }

  getMetadata() {
    return this._metadata;
  }

  setMetadata(metadata) {
    this._metadata = metadata || {};
  }

  toJSON() {
    return {
      id: this.getId(),
      eventType: this.getEventType(),
      source: this.getSource(),
      userId: this.getUserId(),
      description: this.getDescription(),
      timestamp: this.getTimestamp(),
      metadata: this.getMetadata(),
    };
  }

  static fromJSON(data) {
    return new Event({
      id: data.id,
      eventType: data.eventType,
      source: data.source,
      userId: data.userId,
      description: data.description,
      timestamp: data.timestamp,
      metadata: data.metadata || {},
    });
  }

  static currentTimestamp() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }
}

class EventStore {
  constructor(dataFile) {
    this._dataFile = dataFile;
    this._events = [];
    this.loadEvents();
  }

  getDataFile() {
    return this._dataFile;
  }

  setDataFile(dataFile) {
    this._dataFile = dataFile;
    this.loadEvents();
  }

  getEvents() {
    return [...this._events];
  }

  setEvents(events) {
    this._events = events;
    this.saveEvents();
  }

  addEvent(event) {
    this._events.push(event);
    this.saveEvents();
    return event;
  }

  getEventById(eventId) {
    return this._events.find((event) => event.getId() === eventId) || null;
  }

  searchEvents(filters) {
    let results = this.getEvents();

    if (filters.eventType) {
      results = results.filter((event) => event.getEventType() === filters.eventType);
    }
    if (filters.userId) {
      results = results.filter((event) => event.getUserId() === filters.userId);
    }
    if (filters.source) {
      results = results.filter((event) => event.getSource() === filters.source);
    }
    if (filters.startDate) {
      results = results.filter((event) => event.getTimestamp() >= filters.startDate);
    }
    if (filters.endDate) {
      results = results.filter((event) => event.getTimestamp() <= filters.endDate);
    }

    return results;
  }

  loadEvents() {
    if (!fs.existsSync(this._dataFile)) {
      this._events = [];
      return;
    }

    const fileContents = fs.readFileSync(this._dataFile, "utf8");
    if (!fileContents.trim()) {
      this._events = [];
      return;
    }

    const rawEvents = JSON.parse(fileContents);
    this._events = rawEvents.map((rawEvent) => Event.fromJSON(rawEvent));
  }

  saveEvents() {
    const rawEvents = this._events.map((event) => event.toJSON());
    fs.writeFileSync(this._dataFile, JSON.stringify(rawEvents, null, 2));
  }
}

const store = new EventStore(DATA_FILE);

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });
  });
}

function isAuthorized(request, pathname) {
  if (pathname === "/api/v1/health") {
    return true;
  }
  return request.headers.authorization === `Bearer ${AUTH_TOKEN}`;
}

function getQueryObject(searchParams) {
  return Object.fromEntries(searchParams.entries());
}

function buildEventList(events, query) {
  const sort = query.sort || "asc";
  const limit = Number.parseInt(query.limit || "100", 10);
  const offset = Number.parseInt(query.offset || "0", 10);

  const sortedEvents = [...events].sort((a, b) => {
    if (a.getTimestamp() < b.getTimestamp()) return sort === "desc" ? 1 : -1;
    if (a.getTimestamp() > b.getTimestamp()) return sort === "desc" ? -1 : 1;
    return 0;
  });

  const paginatedEvents = sortedEvents.slice(offset, offset + limit);

  return {
    events: paginatedEvents.map((event) => event.toJSON()),
    pagination: {
      limit,
      offset,
      total: events.length,
    },
  };
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = requestUrl.pathname;
  const query = getQueryObject(requestUrl.searchParams);

  if (!isAuthorized(request, pathname)) {
    sendJson(response, 401, { error: "Unauthorized", message: "Authentication is required." });
    return;
  }

  try {
    if (request.method === "GET" && pathname === "/api/v1/health") {
      sendJson(response, 200, { status: "ok", service: "history-event-tracker" });
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/events") {
      const eventData = await readJsonBody(request);
      const event = new Event({
        eventType: eventData.eventType,
        source: eventData.source,
        userId: eventData.userId,
        description: eventData.description,
        metadata: eventData.metadata || {},
      });

      store.addEvent(event);
      sendJson(response, 201, event.toJSON());
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/events") {
      sendJson(response, 200, buildEventList(store.getEvents(), query));
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/events/search") {
      const events = store.searchEvents(query);
      const result = buildEventList(events, query);
      result.filters = query;
      sendJson(response, 200, result);
      return;
    }

    if (pathname.startsWith("/api/v1/events/")) {
      const eventId = pathname.split("/").pop();
      const event = store.getEventById(eventId);

      if (!event) {
        sendJson(response, 404, { error: "EventNotFound", message: "No event was found with the provided ID." });
        return;
      }

      if (request.method === "GET") {
        sendJson(response, 200, event.toJSON());
        return;
      }

      if (request.method === "PUT") {
        const updates = await readJsonBody(request);

        if (Object.prototype.hasOwnProperty.call(updates, "eventType")) event.setEventType(updates.eventType);
        if (Object.prototype.hasOwnProperty.call(updates, "source")) event.setSource(updates.source);
        if (Object.prototype.hasOwnProperty.call(updates, "userId")) event.setUserId(updates.userId);
        if (Object.prototype.hasOwnProperty.call(updates, "description")) event.setDescription(updates.description);
        if (Object.prototype.hasOwnProperty.call(updates, "timestamp")) event.setTimestamp(updates.timestamp);
        if (Object.prototype.hasOwnProperty.call(updates, "metadata")) event.setMetadata(updates.metadata);

        store.saveEvents();
        sendJson(response, 200, event.toJSON());
        return;
      }
    }

    sendJson(response, 404, { error: "NotFound", message: "The requested endpoint does not exist." });
  } catch (error) {
    const errorName = error.message === "Request body must be valid JSON." ? "InvalidJson" : "InvalidEventPayload";
    sendJson(response, 400, { error: errorName, message: error.message });
  }
}

function getArgumentValue(name, defaultValue) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    return defaultValue;
  }
  return process.argv[index + 1];
}

function startServer() {
  const host = getArgumentValue("--host", DEFAULT_HOST);
  const port = Number.parseInt(getArgumentValue("--port", String(DEFAULT_PORT)), 10);

  const server = http.createServer(handleRequest);
  server.listen(port, host, () => {
    console.log(`History Tracker API running at http://${host}:${port}/api/v1`);
    console.log(`Persistent event storage: ${DATA_FILE}`);
    console.log("Press Ctrl+C to stop the server.");
  });
}

startServer();
