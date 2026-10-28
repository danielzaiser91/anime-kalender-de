// Fake-gh für tools/pr-kettenlog.test.mjs: schreibt stderr und endet mit Exit 4.
process.stderr.write('HTTP 404: Not Found (logs expired)\n')
process.exit(4)
