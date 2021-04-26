FROM ruby:latest

RUN apt-get update && \
    apt-get install -y default-mysql-client \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*


WORKDIR /src

RUN bundle config set path 'bundle/vendor'
ADD Gemfile Gemfile
RUN bundle config --local build.mysql2 "--with-ldflags=-L/usr/local/opt/openssl/lib --with-cppflags=-I/usr/local/opt/openssl/include"
RUN gem install mysql2 -v '0.5.3' --source 'https://rubygems.org/'
RUN bundle install

COPY wait.sh wait.sh
RUN chmod +x wait.sh

ENTRYPOINT ./wait.sh
