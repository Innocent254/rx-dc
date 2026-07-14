//go:build windows

package adb

import "syscall"

func windowsDetachedProcessAttributes() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{CreationFlags: 0x00000008}
}
