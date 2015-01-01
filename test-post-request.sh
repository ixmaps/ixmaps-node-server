#!/bin/bash

HOST=${1:-ixmaps.ca}
DEST=${2:-localhost}

curl -X POST -H 'Content-Type: application/json' -d '{
  "requests": [
    {
      "server": "http:/localhost:8181",
      "submitter": "d",
      "postalcode": "h1h",
      "command": "",
      "args": "",
      "type": "submitted",
      "data": "'$HOST'"
    }
  ]
}' http://$DEST:8181/api/requests
