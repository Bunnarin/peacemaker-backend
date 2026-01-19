apt update  
apt upgrade  
apt install git  
git clone this repo
cd peacemaker-backend

# pocketbase
wget pocketbase  
unzip pocketbase.zip  
rm pocketbase.zip  
nano /lib/systemd/system/pocketbase.service
```
[Unit]
Description = pocketbase

[Service]
Type             = simple
User             = root
Group            = root
LimitNOFILE      = 4096
Restart          = always
RestartSec       = 5s
StandardOutput   = append:/root/pb/std.log
StandardError    = append:/root/pb/std.log
WorkingDirectory = /root/pb
ExecStart        = /root/pb/pocketbase serve backend.peacekhth.uk --origins https://peacekhth.uk

[Install]
WantedBy = multi-user.target
```
cp pb_hooks/config.example pb_hooks/config.js  
nano pb_hooks/config.js

./pocketbase superuser create EMAIL PASS  
systemctl enable pocketbase  
systemctl start pocketbase