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

    MS->>API: HTTP Request (GET/POST/PUT)
    activate API

    API->>API: Validate Authorization
    API->>API: Parse URL / Query / Body

    API->>ES: Perform Operation (add/search/get/update)
    ES-->>API: Result Data

    API-->>MS: HTTP Response (JSON)
    deactivate API# History-and-Event-Tracker
