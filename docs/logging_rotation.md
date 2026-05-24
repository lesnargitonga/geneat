Logging rotation
================

Canonical system truth lives in [../README.md](../README.md), especially
[Observability And Operations](../README.md#17-observability-and-operations).

Use `logrotate` or systemd journald for production log rotation. Example
`/etc/logrotate.d/omni` for a file-based logger:

    /var/log/omni/app.log {
        daily
        rotate 14
        compress
        missingok
        notifempty
        copytruncate
    }

If you write logs to stdout (recommended for containers), rely on the
container runtime / systemd to capture and rotate logs rather than writing
files inside the container.
