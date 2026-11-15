#!/usr/bin/env python3
"""Postfach-Helfer des Leitstands: IMAP lesen, SMTP senden. Nur Standardbibliothek.

Liest einen JSON-Auftrag von der Standardeingabe und schreibt JSON auf die Standardausgabe.
Zugangsdaten kommen über stdin, nie über die Kommandozeile.
"""
import email
import email.policy
import html
import imaplib
import json
import re
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parsedate_to_datetime


def text_of(message):
    """Lesbarer Text einer Nachricht: text/plain, sonst HTML ohne Tags."""
    body = message.get_body(preferencelist=("plain", "html"))
    if body is None:
        return ""
    try:
        content = body.get_content()
    except (LookupError, UnicodeDecodeError):
        content = body.get_payload(decode=True).decode("utf-8", "replace")
    if body.get_content_type() == "text/html":
        # Linkziele behalten, sie enthalten oft den Bestätigungslink.
        content = re.sub(r'(?is)<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', r"\2 (\1)", content)
        content = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", content)
        content = re.sub(r"(?s)<[^>]+>", " ", content)
        content = html.unescape(content)
    return re.sub(r"[ \t\r\f\v]+", " ", content).strip()


def summary(uid, raw, full):
    message = email.message_from_bytes(raw, policy=email.policy.default)
    try:
        ts = parsedate_to_datetime(message["Date"]).timestamp() * 1000
    except (TypeError, ValueError):
        ts = 0
    text = text_of(message)
    return {
        "id": uid,
        "from": str(message["From"] or ""),
        "to": str(message["To"] or ""),
        "subject": str(message["Subject"] or ""),
        "ts": ts,
        "text": text if full else text[:2000],
    }


def connect_imap(cfg):
    box = imaplib.IMAP4_SSL(cfg["host"], int(cfg.get("port") or 993), ssl_context=ssl.create_default_context(), timeout=25)
    box.login(cfg["user"], cfg["password"])
    box.select("INBOX", readonly=True)
    return box


def fetch(box, uid, full):
    status, data = box.uid("FETCH", uid, "(BODY.PEEK[])")
    if status != "OK" or not data or not isinstance(data[0], tuple):
        return None
    return summary(uid, data[0][1], full)


def main():
    job = json.load(sys.stdin)
    action = job["action"]
    if action in ("list", "read"):
        box = connect_imap(job["imap"])
        try:
            if action == "read":
                message = fetch(box, str(job["id"]), True)
                if message is None:
                    raise ValueError("Nachricht nicht gefunden")
                return {"message": message}
            status, data = box.uid("SEARCH", None, "ALL")
            uids = data[0].split()[-int(job.get("limit") or 15):] if status == "OK" else []
            messages = [m for m in (fetch(box, uid.decode(), False) for uid in reversed(uids)) if m]
            return {"messages": messages}
        finally:
            try:
                box.logout()
            except Exception:
                pass
    if action == "send":
        cfg = job["smtp"]
        message = EmailMessage()
        message["From"] = cfg["from"]
        message["To"] = job["to"]
        message["Subject"] = job["subject"]
        message["Date"] = formatdate(localtime=True)
        message["Message-ID"] = make_msgid(domain=cfg["from"].split("@")[-1])
        message.set_content(job["text"])
        port = int(cfg.get("port") or 465)
        context = ssl.create_default_context()
        if port == 465:
            server = smtplib.SMTP_SSL(cfg["host"], port, context=context, timeout=25)
        else:
            server = smtplib.SMTP(cfg["host"], port, timeout=25)
            server.starttls(context=context)
        with server:
            server.login(cfg["user"], cfg["password"])
            server.send_message(message)
        return {"sent": True}
    raise ValueError(f"Unbekannte Aktion: {action}")


if __name__ == "__main__":
    try:
        print(json.dumps(main()))
    except Exception as err:  # Der Leitstand zeigt die Meldung an.
        print(json.dumps({"error": f"{type(err).__name__}: {err}"}))
        sys.exit(1)
