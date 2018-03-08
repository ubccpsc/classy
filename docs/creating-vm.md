# 

```
sudo virt-install --name autotest --ram 2048 --disk path=/srv/dev-disk-by-id-md-name-nas-ssdpool/images/kvm/rhel-server-7.4-x86_64-kvm.qcow2 --vcpus 4 --os-type linux --os-variant rhel7 --network bridge=virbr0 --graphics vnc,port=5999 --console pty,target_type=serial --cdrom /srv/dev-disk-by-id-md-name-nas-hddpool/isos/rhel-server-7.4-update-4-x86_64-boot.iso
```


sudo virt-install --name autotest --ram 2048 --disk path=/srv/dev-disk-by-id-md-name-nas-ssdpool/images/kvm/rhel-server-7.4-x86_64-kvm.qcow2 --vcpus 4 --os-type linux --os-variant rhel7 --network bridge=virbr0 --graphics spice --console pty,target_type=serial --cdrom /srv/dev-disk-by-id-md-name-nas-hddpool/isos/rhel-server-7.4-update-4-x86_64-boot.iso
