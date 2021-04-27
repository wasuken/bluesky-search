#!/bin/sh

set -e

echo "Waiting for mysql"

while ! mysqladmin ping -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" --silent; do
    sleep 1
done

>&2 echo "MySQL is up - executing command"

cd /app

yarn install
yarn run dev

# bundle config --local build.mysql2 "--with-ldflags=-L/usr/local/opt/openssl/lib --with-cppflags=-I/usr/local/opt/openssl/include"
# gem install mysql2 -v '0.5.3' --source 'https://rubygems.org/'
bundle config set path 'vendor/bundle'
bundle install

bundle exec ruby srv.rb -o 0.0.0.0
