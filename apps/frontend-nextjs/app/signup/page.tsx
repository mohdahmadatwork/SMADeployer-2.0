"use client"
import axios from 'axios';
import { redirect, useRouter } from 'next/navigation';
import { useState } from 'react';


interface SignupForm {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const SignupPage = () => {
  const [formData, setFormData] = useState<SignupForm>({
    firstname:'',
    lastname:'',
    email:'',
    password:'',
    confirmPassword:'',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };
  const handleSignUp = async ()=>{
    setIsLoading(true);
    const response = await axios.post("http://localhost:3000/api/signup",{...formData});
    console.log(response);
    if (response.status == 200 && response.data.success) {
        redirect("/api/auth/signin");
    }else{
        setError(response.data.data);
    }
    setIsLoading(false);
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12 bg-gray-100">
      <div className="bg-white shadow-md rounded px-8 py-6 w-full max-w-md">
        <h1 className="text-2xl font-bold text-black text-center mb-6">SMADeployer</h1>
        {error && (
          <div className="text-red-500 text-center mb-4">{error}</div>
        )}

          <div className='flex '>
            <div className="mb-4 me-2">
                <label htmlFor="firstname" className="block text-gray-700 text-sm font-bold mb-2">
                First Name
                </label>
                <input
                type="text"
                name="firstname"
                id="firstname"
                value={formData.firstname}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
                />
            </div>
            <div className="mb-4">
                <label htmlFor="lastname" className="block text-gray-700 text-sm font-bold mb-2">
                Last Name
                </label>
                <input
                type="text"
                name="lastname"
                id="lastname"
                value={formData.lastname}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
                />
            </div>

          </div>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              id="email"
              value={formData.email}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              id="password"
              value={formData.password}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
            </div>
          <div className="mb-6">
            <label
              htmlFor="confirmPassword"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>

          <button
            type="submit"
            onClick={handleSignUp}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Sign Up'}
          </button>
      </div>
    </div>
  );
};

export default SignupPage;
