# Moderation

Reports from the app go to the `reports` table. Review and act on them with the
admin API. It's disabled unless `ADMIN_TOKEN` is set on the server (Railway →
`server` service → Variables).

```bash
API=https://server-production-403b.up.railway.app
TOKEN=...   # ADMIN_TOKEN from Railway
auth="Authorization: Bearer $TOKEN"

curl -H "$auth" $API/admin/reports            # open reports (add ?all=1 for history)
curl -H "$auth" -X DELETE $API/admin/posts/<id>          # remove a timeline post
curl -H "$auth" -X DELETE $API/admin/comments/<id>
curl -H "$auth" -X DELETE $API/admin/channel-posts/<id>
curl -H "$auth" -X DELETE $API/admin/channels/<id>
curl -H "$auth" -X POST   $API/admin/users/<id>/ban      # suspend (signs them out everywhere)
curl -H "$auth" -X DELETE $API/admin/users/<id>/ban      # reinstate
curl -H "$auth" -H 'content-type: application/json' -X POST $API/admin/reports/<id>/resolve \
  -d '{"resolution":"user_banned"}'   # dismissed | content_removed | user_banned | warned | escalated
```

Chats are end-to-end encrypted, so for chat reports you can only act on what the
reporter pasted into the report.

**Child sexual abuse material:** remove it, ban the account, keep the report, and
report it to NCMEC's CyberTipline (https://report.cybertip.org) as US law
requires. Never download or forward the material itself.
