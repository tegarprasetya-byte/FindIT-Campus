const verifyRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna belum terautentikasi.'
      });
    }

    if (!allowedRoles.includes(req.user.tipe)) {
      return res.status(403).json({
        success: false,
        message: 'Akses dilarang. Anda tidak memiliki hak akses untuk tindakan ini.'
      });
    }

    next();
  };
};

module.exports = verifyRole;