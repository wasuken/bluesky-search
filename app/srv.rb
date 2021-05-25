require 'sinatra'
require 'sinatra/reloader'
require 'json'
require 'nokogiri'
require 'sequel'
require 'mysql2'
require 'haml'
require 'natto'

require 'benchmark'

configure do
  set :bind, '0.0.0.0'
  register Sinatra::Reloader
  also_reload "./*.rb"
end

INDEX_DIR = './index/'
AOZORA_DIR = '/aozorabunko/cards/**/files/'

NM = Natto::MeCab.new

DB = Sequel.mysql2(
  host: ENV['DB_HOST'],
  user: ENV['DB_USER'],
  password: ENV['DB_PASS'],
  database: ENV['DB_NAME'],
  encoding: 'utf8'
)

def postings_insert(params)
  DB.transaction do
    postings = DB[:postings]
    begin
      postings.multi_insert(params)
    rescue => e
      puts e.message
    end
  end
end

def docs_insert(params)
  DB.transaction do
    docs = DB[:docs]
    params.each do |param|
      begin
        docs.insert(param)
      rescue => e
        puts e.message
      end
    end
  end
end

def rebuild(ptn)
  files = Dir.glob("#{AOZORA_DIR}#{ptn}.html")
  total = files.size
  i = 1
  docs_recs = []
  files.each do |filepath|
    f = nil
    if File.read(filepath, 500).include?('charset=Shift_JIS')
      f = File.open(filepath, mode = "rt:sjis:utf-8").read
    else
      f = File.read(filepath)
    end
    doc = Nokogiri::HTML.parse(f, nil, 'UTF-8')
    text = doc.at_css("body").text
    puts text[0..100]
    title = doc.title.force_encoding('UTF-8')
    puts "[#{i+1}/#{total}] size: #{text.size}, #{filepath}"
    postings_recs = []
    if text.size > 5000
      begin
        p_rec_map = {  }
        text.scan(/.{1,5000}/).each do |t|
          NM.enum_parse(t)
            .select{ |x| x.surface.chomp.size >= 2 && !x.surface.chomp.empty?}
            .group_by{ |n| n.surface.chomp }
            .each do |k,v|
            if p_rec_map[k]
              p_rec_map[k][:cnt] += v.size
            else
              p_rec_map[k] = {
                name: k,
                document_path: filepath,
                cnt: v.size,
              }
            end
          end
        end
        postings_recs = p_rec_map.values
      rescue => e
        puts e.full_message
      end
    else
      postings_recs = NM.enum_parse(text)
                        .select{ |x| x.surface.chomp.size >= 2 && !x.surface.chomp.empty?}
                        .group_by{ |n| n.surface.chomp }
                        .map do |k,v|
        {
          name: k,
          document_path: filepath,
          cnt: v.size,
        }
      end
    end

    postings_insert(postings_recs)
    i += 1
    docs_recs << {
      document_path: filepath,
      plain_content: text,
      title: title
    }
  end
  docs_insert(docs_recs)
  return total
end

get '/api/v1/search' do
  start_time = Time.now

  q, s = params['q'], params['s']
  if q.empty? || q.nil?
    rst = DB[:docs].limit(30).map{ |p|
      {
        id: p[:doc_id],
        title: p[:title],
        path: p[:document_path],
        parts_of_content: p[:plain_content][0..100],
      }
    }
    tm = Time.now - start_time
    content_type :json
    return {q: q, articles: rst, time: tm}.to_json
  end
  tokens = NM.enum_parse(q).select{ |x| x.size > 2}.map(&:surface)
  rst = DB[:postings]
          .join_table(:inner, :docs)
          .where(name: tokens)
          .order(Sequel.desc(:cnt))
          .limit(30).map do |row|
    {
      id: p[:doc_id],
      title: p[:title],
      path: row[:docs][:document_path],
      parts_of_content: row[:plain_content][0..100],
    }
  end
  tm = Time.now - start_time
  content_type :json
  {q: q, articles: rst, time: tm}.to_json
end

get '/api/v1/file' do
  content_type :json
  rec = DB[:docs].first(doc_id: params[:id])
  {
    id: rec[:doc_id],
    title: rec[:title],
    path: rec[:document_path],
    content: rec[:plain_content],
  }.to_json
end

get '/api/v1/rebuild/full' do
  content_type :json
  total = rebuild('*')
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
