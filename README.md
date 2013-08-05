# SYNOPSIS
An invite-only-model public key server.

# USAGE
```bash
npm install pkp -g
pkp init
mkdir server
npm install pks
node server.js
```

# SERVER SPECIFICATION
Keys are stored in certificates. A certificate has some meta data that describes
a key.

A server should
  - Without auth
    - Responsd with a certificate when queried with a public key
  - With auth
    - Store a certificate
  - Replicate in a Master/Master Scenario according to any known servers in its database
  - Provide a list of up to 5 of the most recently successful servers that it has replicated to
  - Run on port 11372 (the next port after a well known port for the openPGP key server)

# CERTIFICATE DEFINITION

```json
{
  "address-at": "paolo@async.ly",
  "servers-at": ["async.ly", "ghub.io"],
  "public": "...",
  "algorithm": "rsa"
}
```

# INVITATION TEMPLATE
```text

  Hello,

  I am running an experimental, invite-only-model Public Key
  Server. I'd like to invite you to store your public key and
  email address on it so that they can be made available for
  public inquiry.

  Why

  As your software becomes widely distributed and highly used,
  people will want to determine if they can "trust" it.

  With a tool like Public Key Pen, you can create certificates
  for your software. A certificate is a cryptographic signature
  of the data, your public key and your name. A certificate can
  be distributed with your software.

  When someone wants to verify a certificate, they can search
  through a non-centralized network of Public Key Servers to
  establish "trust" from consensus.

  How

  Servers are "invite only". This means that the data found on
  it was added by its owner or other servers that were invited
  to participate in data replication. This reduces the number 
  of possible "bad" certificates in circulation.

  Links

  Public Key Pen (https://github.com/hij1nx/pkp)
  Public Key Server (https://github.com/hij1nx/pks)

```
