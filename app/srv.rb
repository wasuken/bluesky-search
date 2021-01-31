require 'sinatra'
require 'natto'
require 'json'
require 'digest'
require 'nokogiri'
require 'nkf'

NATTO = Natto::MeCab.new

INDEX_DIR = './index/'
AOZORA_DIR = '/aozorabunko/cards/**/files/'

get '/search' do
  q, s = params['q'], params['s']
  File.read(idx_hash_path(q))
end

get '/rebuild' do
  files = Dir.glob("#{AOZORA_DIR}5*.html")[0..1600]
  total = files.size
  files[0..100].each_with_index do |filepath, i|
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
    body = doc.at_css("body")
    text = body.text
    puts "[#{i+1}/#{total}] size: #{text.size}, #{filepath}"

  end
  "success"
end
