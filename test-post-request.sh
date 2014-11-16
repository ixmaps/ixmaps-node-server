curl -X POST -H "Content-Type: application/json" -d '{
  "requests": [
    {
      "server": "http:/localhost:8181",
      "submitter": "d",
      "postalcode": "h1h",
      "command": "traceroute",
      "args": "",
      "type": "submitted",
      "data": "cbc.ca"
    }
  ]
}' http://localhost:8181/api/requests
