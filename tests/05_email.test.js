const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')
const { MockEmail } = require('./helper')
const path = require('path')
const fs = require('fs')

let channel
let __email
let __emailArr

test('send email', async t => {
  t.plan(1)

  channel = await OpenChannel()

  const payload = {
    email: MockEmail({ emailId: null, folderId: 1, aliasId: null, unread: 0 })
  }

  channel.send({ event: 'email:sendEmail', payload })

  channel.once('email:sendEmail:success', data => {
    console.log('SUCCESS :: ', data)
    t.ok(data.emailId)
  })

  channel.once('email:sendEmail:error', error => {
    console.log(JSON.stringify(error))
    t.fail(error.message)
  })
})

test('save sent email to database', async t => {
  t.plan(1)

  const mockEmail = MockEmail({ subject: 'New Incoming Message', emailId: null, folderId: 1, aliasId: null, unread: 0 })

  const payload = {
    type: 'Incoming',
    messages: [mockEmail],
  }

  channel.send({ event: 'email:saveMessageToDB', payload })

  channel.once('email:saveMessageToDB:success', data => {
    console.log('SUCCESS :: ', data)
    t.equals(data.msgArr.length, 1)
  })

  channel.once('email:saveMessageToDB:error', error => {
    t.fail(error.message)
  })
})

test('save incoming alias email', async t => {
  t.plan(2)

  const payload = {
    namespaceName: 'alice2022',
    domain: 'telios.io',
    address: 'existing',
    description: '',
    fwdAddresses: '',
    disabled: false,
    count: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  channel.send({ event: 'alias:registerAliasAddress', payload })

  channel.once('alias:registerAliasAddress:success', alias => {

    const mockEmail = MockEmail({ to: { address: 'alice2022#existing@telios.io' }, unread: 0 })

    const payload = {
      type: 'Incoming',
      messages: [mockEmail],
    }

    channel.send({ event: 'email:saveMessageToDB', payload })

    channel.once('email:saveMessageToDB:success', data => {
      console.log('SUCCESS :: ', data)
      __email = data.msgArr[0]
      t.equals(data.msgArr.length, 1)
      t.equals(data.msgArr[0].aliasId, alias.aliasId)
    })

    channel.once('email:saveMessageToDB:error', error => {
      t.fail(error.message)
    })
  })
})

test('save email attachments', async t => {
  t.plan(1)

  const payload = {
    filepath: __dirname + '\\newDir\\test.png',
    attachments: JSON.parse(__email.attachments)
  }

  channel.send({ event: 'email:saveFiles', payload })

  channel.once('email:saveFiles:success', data => {
    t.ok(true)
  })

  channel.once('email:saveFiles:error', error => {
    t.fail(error.message)
  })

  t.teardown(() => {
    fs.rmSync(__dirname + '/newDir', { recursive: true })
  })
})

test('generate new aliases for on-the-fly email', async t => {
  t.plan(2)
    const mockEmail = MockEmail({ to: { address: 'alice2022#onthefly@telios.io' }, unread: 0 })

    const payload = {
      type: 'Incoming',
      messages: [mockEmail],
    }

    channel.send({ event: 'email:saveMessageToDB', payload })

    channel.once('email:saveMessageToDB:success', data => {
      console.log('SUCCESS :: ', data)
      __emailArr = data.msgArr
      t.equals(data.msgArr.length, 1)
      t.equals(data.newAliases.length, 1)
    })

    channel.once('email:saveMessageToDB:error', error => {
      t.fail(error.message)
    })
})

test('save email as draft', async t => {
  t.plan(2)

  const mockEmail = MockEmail({ unread: 0 })

  const payload = {
    type: 'Draft',
    messages: [mockEmail],
  }

  channel.send({ event: 'email:saveMessageToDB', payload })

  channel.once('email:saveMessageToDB:success', data => {
    console.log('SUCCESS :: ', data)
    t.equals(data.msgArr.length, 1)
    t.equals(data.msgArr[0].folderId, 2)
  })

  channel.once('email:saveMessageToDB:error', error => {
    t.fail(error.message)
  })
})

test('get emails by folder ID', async t => {
  t.plan(1)

  const payload = {
    id: 5
  }

  channel.send({ event: 'email:getMessagesByFolderId', payload })

  channel.once('email:getMessagesByFolderId:success', data => {
    t.equals(data.length, 2)
  })

  channel.once('email:getMessagesByFolderId:error', error => {
    t.fail(error.message)
  })
})

test('get messages by alias ID', async t => {
  t.plan(1)

  const payload = {
    id: 'alice2022#existing'
  }

  channel.send({ event: 'email:getMessagesByAliasId', payload })

  channel.once('email:getMessagesByAliasId:success', data => {
    t.equals(data.length, 1)
  })

  channel.once('email:getMessagesByAliasId:error', error => {
    t.fail(error.message)
  })
})

test('move emails to another folder', async t => {
  t.plan(2)

  const emails = __emailArr.map(msg => {
    return {
      ...msg,
      folder: {
        toId: 1
      }
    }
  })

  const payload = {
    messages: emails
  }

  channel.send({ event: 'email:moveMessages', payload })

  channel.once('email:moveMessages:success', data => {
    
    // Verify emails correctly moved
    const payload = {
      id: 1
    }
  
    channel.send({ event: 'email:getMessagesByFolderId', payload })

    channel.once('email:getMessagesByFolderId:success', emails => {
      for(const email of emails) {
        t.equals(email.folderId, 1)
      }
    })
  })

  channel.once('email:moveMessages:error', error => {
    t.fail(error.message)
  })
})

test('get email by ID', async t => {
  t.plan(1)

  const payload = {
    id: __email.emailId
  }

  channel.send({ event: 'email:getMessageById', payload })

  channel.once('email:getMessageById:success', data => {
    t.equals(data.emailId, __email.emailId)
  })

  channel.once('email:getMessageById:error', error => {
    t.fail(error.message)
  })
})

test('mark email as unread', async t => {
  t.plan(1)

  const payload = {
    id: __email.emailId
  }

  channel.send({ event: 'email:markAsUnread', payload })

  channel.once('email:markAsUnread:success', data => {
    t.ok(true)
  })

  channel.once('email:markAsUnread:error', error => {
    t.fail(error.message)
  })
})

test('remove emails from DB and file system', async t => {
  t.plan(1)

  const payload = {
    messageIds: [__email.emailId]
  }

  channel.send({ event: 'email:removeMessages', payload })

  channel.once('email:removeMessages:success', data => {
    t.ok(true)
  })

  channel.once('email:removeMessages:error', error => {
    t.fail(error.message)
  })
})

test('email full text search', async t => {
  t.plan(1)

  const payload = {
    searchQuery: 'Subject-'
  }

  channel.send({ event: 'email:searchMailbox', payload })

  channel.once('email:searchMailbox:success', data => {
    t.ok(data.length > 0)
  })

  channel.once('email:searchMailbox:error', error => {
    console.log(JSON.stringify(error))
    t.fail(error.message)
  })

  t.teardown(() => {
    channel.kill()
  })
})