const fs = require('fs');
const FormData = require('form-data');
const form = new FormData();
form.append('parentId', '');
form.append('file', Buffer.from('hello'), { filename: 'test.txt', contentType: 'text/plain' });
fetch('http://127.0.0.1:3000/api/google/drive/upload', {
  method: 'POST',
  body: form,
  headers: form.getHeaders()
}).then(r=>r.text()).then(console.log);
