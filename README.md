# SYNOPSIS
An invite-only-model public key server.

# SERVER SPECIFICATION

A server should
  - Without auth
    - Responsd to a fingerprint with a public key
  - With auth
    - Store a certificate which creates a certificate that has
      - a finger print from which to access the `subject` (a public key)
      - the `issuer`'s available identity (server address, url, email, etc.)
      - the `subject`'s available identity (server address, url, email, etc.)
      - ctime
  - Store fingerprints so that lookup time is fast
  - Replicate in a Master/Master Scenario according to any known servers in its database

A client should
  - Without auth
    - Successfully request a public key based on a fingerprint.
  - With auth
    - Successfully store a new certificate on a server
