Microservie 3: History and Event log/tracker

Description: This microservice handles the users events and submissions when running the program, it then save these event with their time stamps allowing users o later review what submissions occured, when, and what was comepleted during it

How to REQUEST data: To retrieve certain events that have occured the user submits a GET request that searchs for all events that have happened whle also allowing he user to filter the events ccoridng to title of event as well as the user that submitted it 

Example Call:
  async function getEvents() {
    const response = await fetch("http://127.0.0.1:3000/api/v1/events?limit=50&sort=desc", {
      method: "GET",
      headers: {
        "Authorization": "Bearer demo-token",
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    console.log("Received events:", data);
  }
  getEvents();

How to RECEIVE Data: When the microservice receives a new event it verifies whather an event was comppleted the user it was completed by and the time it which it occured Saving the event with a JSON Body that contains them

Example Call:
  async function requestEvents() {
    const res = await fetch("http://127.0.0.1:3000/api/v1/events?limit=100&sort=asc", {
      headers: {
        "Authorization": "Bearer demo-token"
      }
    });

    const data = await res.json();
    console.log("Received:", data);
  }

  requestEvents();

UML Sequence Diagram:
  sequenceDiagram
    participant MS as Other Microservice
    participant API as History Tracker API
    participant ES as Event Store

User / Client                       API Web Service                     EventStore / Data File
     │                                    │                                    │
     │─── 1. Send API Request ──────────>│                                    │
     │    GET / POST / PUT endpoint       │                                    │
     │                                    │                                    │
     │                                    │─── 2. Check Authorization ───────┐ │
     │                                    │◄─────────────────────────────────┘ │
     │                                    │                                    │
     │                                    │◄── 3. [FAIL] Missing/Bad Token ──│
     │◄── 4. 401 Unauthorized JSON ──────│                                    │
     │                                    │                                    │
     │                                    │─── 5. [PASS] Route Request ──────┐ │
     │                                    │◄─────────────────────────────────┘ │
     │                                    │                                    │
     │                                    │─── 6. Read/Validate Request Data ┐│
     │                                    │◄─────────────────────────────────┘│
     │                                    │                                    │
     │                                    │◄── 7. [FAIL] Bad JSON/Fields ────│
     │◄── 8. 400 Bad Request JSON ───────│                                    │
     │                                    │                                    │
     │                                    │─── 9. Read, Search, Add, or Update│
     │                                    │    Event Data ──────────────────>│
     │                                    │                                    │
     │                                    │◄── 10. Event Data / Save Complete│
     │                                    │                                    │
     │◄── 11. 200/201 Success JSON ──────│                                    │
     │                                    │                                    │
     │─── 12. Unknown Endpoint ─────────>│                                    │
     │◄── 13. 404 NotFound JSON ─────────│                                    │
