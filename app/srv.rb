require 'sinatra'
require 'json'
require 'nokogiri'
require 'rom'
require 'rom-repository'

NATTO = Natto::MeCab.new

INDEX_DIR = './index/'
AOZORA_DIR = '/aozorabunko/cards/**/files/'

DB = Sequel.connect('mysql2://root:test@db/bluesky')


def insert(params)
  db.transaction do
    docs = DB[:documents]
    docs.multi_insert(params)
  end
end


get '/search' do
  q, s = params['q'], params['s']
  File.read(idx_hash_path(q))
end

get '/rebuild' do
  files = Dir.glob("#{AOZORA_DIR}5*.html")[0...100]
  total = files.size
  recs = files.map do |filepath|
    f = File.open(filepath, mode = "rt:sjis:utf-8").read
    text = doc.at_css("body").text
    doc = Nokogiri::HTML.parse(
      f,
      nil,
      'UTF-8')
    puts "[#{i+1}/#{total}] size: #{text.size}, #{filepath}"
    {filepath: filepath, content: text}
  end
  insert(recs)
end
