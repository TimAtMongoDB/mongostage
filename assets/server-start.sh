#!/bin/bash
mongod --dbpath /home/mongo/data --logpath /tmp/mongod.log &
for i in $(seq 1 20); do
  mongosh --quiet --eval "db.adminCommand({ping:1})" > /dev/null 2>&1 && break
  sleep 1
done
exec bash
