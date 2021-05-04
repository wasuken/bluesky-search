require 'sinatra'
require 'sinatra/reloader'
require 'json'
require 'nokogiri'
require 'sequel'
require 'mysql2'
require 'haml'

require 'benchmark'

configure do
  set :bind, '0.0.0.0'
  register Sinatra::Reloader
  also_reload "./*.rb"
end

INDEX_DIR = './index/'
AOZORA_DIR = '/aozorabunko/cards/**/files/'

DB = Sequel.mysql2(
  host: ENV['DB_HOST'],
  user: ENV['DB_USER'],
  password: ENV['DB_PASS'],
  database: ENV['DB_NAME'],
  encoding: 'utf8'
)

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

get '/api/v1/search' do
  q, s = params['q'], params['s']
  rst = DB['select * from documents where MATCH (content) AGAINST (?)', q].take(100).map do |row|
    {
      id: row[:id],
      filepath: row[:filepath],
      title: row[:title],
      parts_of_content: row[:content][0..100]
    }
  end
  content_type :json
  {q: q, articles: rst}.to_json
end

get '/api/v1/file' do
  content_type :json
  row = DB[:documents].first(id: params['id'])
  {
    id: row[:id],
    title: row[:title],
    content: row[:content]
  }.to_json
end

get '/api/v1/rebuild/full' do
  content_type :json
  total = rebuild('[1-8]5*')
  {
    msg: 'success',
    items: total,
  }.to_json
end

get '/api/v1/rebuild' do
  content_type :json
  total = rebuild('[1-8]5*')
  {
    msg: 'success',
    items: total,
  }.to_json
end

get '/' do
  haml :index
end

# rebuild('*')
