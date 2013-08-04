# SYNOPSIS
An invite-only-model public key server.

# DESCRIPTION


# SERVER SPECIFICATION
Keys are stored in certificates. A certificate has some meta data that describes
a key.

A server should
  - Without auth
    - Responsd with a certificate when queried with a public key
  - With auth
    - Store a certificate which creates a certificate that has
      - a finger print from which to access the `subject` (a public key)
      - the `issuer`'s available identity (server address, url, email, etc.)
      - the `subject`'s available identity (server address, url, email, etc.)
      - ctime
  - Replicate in a Master/Master Scenario according to any known servers in its database
  - Provide a list of up to 5 of the most recently successful servers that it has replicated to
  - Run on port 11372 (the next port after a well known port for the openPGP key server)

# CERTIFICATE DEFINITION

```json
{
  'address-at': 'paolo@async.ly',
  'servers-at': ['async.ly', 'ghub.io'],
  'public': '...',
  'algorithm': 'rsa'
}
```
