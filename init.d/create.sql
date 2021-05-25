create database bluesky;
use bluesky;

CREATE TABLE documents(
	   id SERIAL PRIMARY KEY,
	   filepath VARCHAR(300),
	   content TEXT,
	   title VARCHAR(200),
	   FULLTEXT(content) WITH PARSER ngram
) CHARACTER SET utf8;

CREATE TABLE docs(
	   doc_id SERIAL PRIMARY KEY,
	   document_path VARCHAR(200) UNIQUE,
	   plain_content TEXT,
	   title VARCHAR(200)
) CHARACTER SET utf8;

CREATE TABLE postings(
	   posting_id SERIAL PRIMARY KEY,
	   name VARCHAR(50),
	   document_path VARCHAR(200),
	   cnt INT(10),
	   UNIQUE(name, document_path)
) CHARACTER SET utf8;
