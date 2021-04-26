require 'sinatra'
require 'sinatra/reloader'
require 'json'
require 'nokogiri'
require 'sequel'
require 'mysql2'

require 'benchmark'

configure do
  set :bind, '0.0.0.0'
  register Sinatra::Reloader
  also_reload "./*.rb"
end

INDEX_DIR = './index/'
AOZORA_DIR = '/aozorabunko/cards/**/files/'

DB = Sequel.connect(adapter: 'mysql2', host: 'db', database: 'bluesky', user: 'root', password: 'test', encoding: 'utf8')

def insert(params)
  DB.transaction do
    docs = DB[:documents]
    params.each do |param|
      begin
        docs.insert(param)
      rescue => e
        p e
      end
    end
  end
end

def rebuild(ptn)
  Benchmark.bm 10 do |r|
    r.report "rebuild" do
      files = Dir.glob("#{AOZORA_DIR}#{ptn}.html")
      total = files.size
      i = 1
      recs = files.map do |filepath|
        f = nil
        if File.read(filepath, 500).include?('charset=Shift_JIS')
          f = File.open(filepath, mode = "rt:sjis:utf-8").read
        else
          f = File.read(filepath)
        end
        doc = Nokogiri::HTML.parse(f, nil, 'UTF-8')
        text = doc.at_css("body").text
        title = doc.title
        puts "[#{i+1}/#{total}] size: #{text.size}, #{filepath}"
        i += 1
        {
          filepath: filepath,
          content: text,
          title: title
        }
      end
      insert(recs)
      return total
    end
  end
end

get '/search' do
  q, s = params['q'], params['s']
  rst = DB['select * from documents where MATCH (content) AGAINST (?)', q].take(100).map do |row|
    {
      filepath: row[:filepath],
      title: row[:title],
      parts_of_content: row[:content][0..100]
    }
  end
  content_type :json
  {q: q, data: rst}.to_json
end

get '/rebuild' do
  content_type :json
  total = rebuild('[1-8]5*')
  {
    msg: 'success',
    items: total,
  }.to_json
end
rebuild('*')
