# Operations

## VM Requirements

### Production Environment

Virtual Machines (VMs) to host Classy in a production environment are typically 100GB storage, 6 CPUs, and 16 GB RAM with a XFS filesystem built with the `dtype = 1` flag. The high disk space is due to the accumulation of assignment execution data.

### Staging Environment

VMs to host Classy in a staging environment are typically 40GB, 3CPUs, 8GB of RAM with a XFS filesystem build with the `dtype = 1` flag.
