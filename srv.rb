require 'sinatra'
require 'natto'
require 'json'
require 'digest'
require 'nokogiri'
require 'nkf'

NATTO = Natto::MeCab.new

INDEX_DIR = './index/'
AOZORA_DIR = './aozorabunko/cards/**/files/'

def idx_hash_path(s)
  sha = Digest::SHA1.hexdigest(s)
  "#{INDEX_DIR}#{sha}"
end

def parse(str, n=NATTO)
  n.enum_parse(str)
end

def parse_grp(enum)
  enum
    .filter{|x| x.surface.size > 2}
    .map(&:surface)
    .group_by{|a| a}
end

def n_grams_parse_grp(str)
  n_grams(str).group_by{|a| a}
end

def n_grams(str, n=3)
  grams = []
  str.chars.each_slice(3) do |chrs|
    grams << chrs.join
  end
  grams
end

def gen_idx(filepath, w, cnt)
  File.open(idx_hash_path(w), mode = "a") do |f|
    f.write(idx_hash_path(w), "#{filepath} #{cnt}\n")
  end
end

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
    puts "[#{i+1}/#{total}] size: #{text.size}, #{filepath} split: #{text.size > 30000}"
    n_grams_parse_grp(text).each do |key, values|
      gen_idx(filepath, key, values.size)
    end
    # if text.size <= 10000
    #   n_grams_parse_grp(text).each do |key, values|
    #     gen_idx(filepath, key, values.size)
    #   end
    # else
    #   # puts "skip"
    #   # cnt = 1
    #   # tc = text.chars
    #   # slice_size = (tc.size - (tc.size % 5000)) / 5000
    #   # slice_size += 1 unless (tc.size % 5000) == 0
    #   # h = {}
    #   # text.chars.each_slice(5000) do |chars|
    #   #   puts "	[#{cnt}/#{slice_size}]"
    #   #   n_grams_parse_grp(chars.join).each do |key, values|
    #   #     h[key] = 0 unless h[key]
    #   #     h[key] += values.size
    #   #     # gen_idx(filepath, key, values.size)
    #   #   end
    #   #   cnt += 1
    #   # end
    #   # h.each{|k,v| gen_idx(filepath, k, v)}
    # end
  end
  "success"
end
