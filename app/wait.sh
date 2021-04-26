#!/bin/sh

set -e

echo "Waiting for mysql"

while ! mysqladmin ping -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" --silent; do
    sleep 1
done

>&2 echo "MySQL is up - executing command"

bundle exec ruby srv.rb -o 0.0.0.0
