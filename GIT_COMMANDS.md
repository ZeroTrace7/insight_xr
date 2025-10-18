# 🚀 Git Commands Reference Guide

Quick reference for updating your GitHub repository.

---

## 🔄 **Standard Workflow (Recommended)**

Use these commands every time you make changes:

### **Step 1: Check Status**
```bash
git status
```
Shows what files have been modified, added, or deleted.

### **Step 2: Add Changes**
```bash
git add .
```
Stages all changes for commit (`.` means "all files").

**Or add specific files:**
```bash
git add index.tsx
git add index.css index.html
```

### **Step 3: Commit Changes**
```bash
git commit -m "Your descriptive message here"
```

**Good commit message examples:**
- `git commit -m "Add avatar selection feature"`
- `git commit -m "Fix login bug"`
- `git commit -m "Update styling for profile page"`
- `git commit -m "Remove API keys from deployment guide"`

### **Step 4: Push to GitHub**
```bash
git push origin main
```
Uploads your changes to GitHub.

---

## ⚡ **Quick One-Liner**

Do all steps at once:

```bash
git add . ; git commit -m "Update project" ; git push origin main
```

**With custom message:**
```bash
git add . ; git commit -m "Add new feature" ; git push origin main
```

---

## 📋 **Common Scenarios**

### **Scenario 1: Made changes to code**
```bash
git status                          # See what changed
git add .                           # Add all changes
git commit -m "Update features"     # Commit
git push origin main                # Push to GitHub
```

### **Scenario 2: Added new files**
```bash
git add .                           # Add new files
git commit -m "Add new components"  # Commit
git push origin main                # Push
```

### **Scenario 3: Deleted files**
```bash
git add -A                          # Add all (including deletions)
git commit -m "Remove old files"    # Commit
git push origin main                # Push
```

### **Scenario 4: Updated multiple files**
```bash
git add index.tsx index.css         # Add specific files
git commit -m "Update UI styling"   # Commit
git push origin main                # Push
```

---

## 🔍 **Useful Commands**

### **Check what you changed:**
```bash
git status
```

### **See detailed changes:**
```bash
git diff
```

### **View commit history:**
```bash
git log
```

### **View last 5 commits:**
```bash
git log --oneline -5
```

### **Undo last commit (keep changes):**
```bash
git reset --soft HEAD~1
```

### **Discard all local changes:**
```bash
git restore .
```

### **Pull latest from GitHub:**
```bash
git pull origin main
```

---

## 🎯 **Daily Workflow Example**

**Morning - Start work:**
```bash
git pull origin main              # Get latest code
```

**After making changes:**
```bash
git status                         # Check what changed
git add .                          # Add changes
git commit -m "Add new feature"    # Commit
git push origin main               # Push to GitHub
```

**End of day:**
```bash
git add .
git commit -m "End of day commit"
git push origin main
```

---

## 📦 **PowerShell Aliases (Optional)**

Make commands shorter by adding these to your PowerShell profile:

```powershell
# Add to: $PROFILE (run: notepad $PROFILE)

function gs { git status }
function ga { git add . }
function gc { param($msg) git commit -m $msg }
function gp { git push origin main }
function gac { param($msg) git add . ; git commit -m $msg }
function gacp { param($msg) git add . ; git commit -m $msg ; git push origin main }
```

**Then use:**
```bash
gs                           # Instead of: git status
ga                           # Instead of: git add .
gc "message"                 # Instead of: git commit -m "message"
gp                           # Instead of: git push origin main
gacp "message"               # All in one!
```

---

## ⚠️ **Important Notes**

### **Files That Won't Be Uploaded:**
These are in `.gitignore` and stay on your computer:
- `.env.local` (API keys - never upload!)
- `node_modules/` (too large)
- `dist/` (build files)

### **Before Every Push:**
✅ Check you're not committing sensitive data
✅ Test your code works
✅ Write a clear commit message

### **Commit Message Best Practices:**
✅ **Good:** "Add avatar selection modal"
✅ **Good:** "Fix Firebase authentication bug"
❌ **Bad:** "Update"
❌ **Bad:** "asdf"
❌ **Bad:** "fixes"

---

## 🔄 **Automatic Deployments**

Remember: Your GitHub repo is connected to Vercel!

**Every time you push to GitHub:**
1. GitHub receives your code
2. Vercel detects the change
3. Vercel automatically builds and deploys
4. Your live site updates in 2-3 minutes!

**Check deployments:**
- Visit: https://vercel.com/dashboard
- See real-time build logs
- Get instant preview URLs

---

## 🆘 **Troubleshooting**

### **Problem:** "fatal: not a git repository"
**Solution:** You're not in the project folder
```bash
cd C:\Users\HP\Downloads\insight_xr
```

### **Problem:** "rejected - non-fast-forward"
**Solution:** Pull first, then push
```bash
git pull origin main
git push origin main
```

### **Problem:** "Permission denied"
**Solution:** Login to GitHub in terminal
```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

### **Problem:** Committed wrong files
**Solution:** Undo last commit
```bash
git reset --soft HEAD~1    # Undo commit, keep changes
git reset --hard HEAD~1    # Undo commit, discard changes
```

---

## 📚 **Quick Reference Card**

| Task | Command |
|------|---------|
| Check status | `git status` |
| Add all files | `git add .` |
| Add specific file | `git add filename.tsx` |
| Commit | `git commit -m "message"` |
| Push to GitHub | `git push origin main` |
| Pull from GitHub | `git pull origin main` |
| View history | `git log` |
| See changes | `git diff` |
| Undo commit | `git reset --soft HEAD~1` |
| All in one | `git add . ; git commit -m "msg" ; git push origin main` |

---

## 🎉 **You're All Set!**

**Your typical workflow:**
1. Make changes to your code
2. Run: `git add . ; git commit -m "What you changed" ; git push origin main`
3. Wait 2 minutes
4. Your site auto-updates on Vercel!

**Repository:** https://github.com/ZeroTrace7/insight_xr
**Live Site:** Check Vercel dashboard for URL

---

**Pro Tip:** Commit and push frequently (multiple times per day) to keep your work backed up!
