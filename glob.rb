File.write('rb.log', Dir.glob('./aozorabunko/cards/**/*.html')
                       .sort{|a,b| a <=> b}
                       .join("\n"))
