FROM ruby:latest

RUN apt-get update \
	&& apt-get install -y mysql-client libmysqlclient-dev --no-install-recommends \
	&& apt-get clean \
	&& rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /src

RUN bundle conifg set path 'bundle/vendor'

RUN bundle install

RUN bundle exec ruby srv.rb
