require 'sinatra'
require 'json'
require 'nokogiri'
require 'sequel'
require 'mysql2'

INDEX_DIR = './index/'
AOZORA_DIR = '/aozorabunko/cards/**/files/'

def insert(params)
  db = Sequel.connect(adapter: 'mysql2', host: 'db', database: 'bluesky', user: 'root', password: 'test', encoding: 'utf8')
  db << 'SET NAMES utf8'
  db.transaction do
    docs = db[:documents]
    params.each do |param|
      begin
        docs.insert(param)
      rescue => e
        p e
      end
    end
  end
end

get '/search' do
  db = Sequel.connect(adapter: 'mysql2', host: 'db', database: 'bluesky', user: 'root', password: 'test', encoding: 'utf8')
  db << 'SET NAMES utf8'
  q, s = params['q'], params['s']
  rst = db['select * from documents where MATCH (content) AGAINST (?)', q].take(100).map do |row|
    {filepath: row[:filepath]}
  end
  {q: q, data: rst}.to_json
end

get '/rebuild' do
  files = Dir.glob("#{AOZORA_DIR}[1-8]5*.html")
  total = files.size
  i = 1
  recs = files.map do |filepath|
    f = nil
    if File.read(filepath, 500).include?('charset=Shift_JIS')
      f = File.open(filepath, mode = "rt:sjis:utf-8").read
    else
      f = File.read(filepath)
    end
    doc = Nokogiri::HTML.parse(
      f,
      nil,
      'UTF-8')
    text = doc.at_css("body").text
    puts "[#{i+1}/#{total}] size: #{text.size}, #{filepath}"
    i += 1
    {filepath: filepath, content: text}
  end
  insert(recs)
  {msg: 'success', items: total}
end
