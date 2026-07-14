//go:build !windows

package adb

import "syscall"

func windowsDetachedProcessAttributes() *syscall.SysProcAttr { return nil }
