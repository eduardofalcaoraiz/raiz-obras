from setuptools import setup


setup(
    name="opencv-python",
    version="4.12.0.88",
    description="Raiz Obras dependency shim: cv2 is provided by opencv-python-headless.",
    py_modules=[],
    install_requires=["opencv-python-headless==4.12.0.88"],
)
