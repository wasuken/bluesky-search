create database bluesky;
use bluesky;

CREATE TABLE documents(
	   id SERIAL PRIMARY KEY,
	   filepath VARCHAR(300),
	   content TEXT,
	   title VARCHAR(200),
	   FULLTEXT(content) WITH PARSER ngram
) CHARACTER SET utf8;
